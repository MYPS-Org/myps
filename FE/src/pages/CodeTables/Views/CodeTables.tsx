"use-client";


const CodeTables: React.FC = () => {
  return (
    <div className="w-full text-left p-6 m-6 space-y-6 bg-white">
        <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold mb-4">Code Tables</h1>
        </div>
        <div>
            <label className="block text-left text-sm font-medium text-gray-700 mb-1">Status</label>
            <div className="flex items-center">
                <select 
                value=""
                // onChange={}
                className='w-1/3 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900'
                >
                    <option value="Category">Category</option>
                    <option value="Thrust">Thrust</option>
                    <option value="ProjectOrigin">Project Origin</option>
                    <option value="MajorWorkCategory">Major Work Category</option>
                </select>
            </div>
        </div>
        {/* Tables Here */}
    </div>
  );
}

export default CodeTables;